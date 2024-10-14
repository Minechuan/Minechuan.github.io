//仍然可以使用递归算法，因为可以根据后序串得到子树，然后子树的节点个数是相同的，且连续的，可以
//把父节点的序列分成几部分。
//这道题需要实际构造一棵树,在节点中储存这个节点的子节点个数，最后搜索树的时候，利用组合数公式，结合k叉树的概念
#include<iostream>
#include<string>
using namespace std;
int m;
string s1,s2;
struct TreeNode{//输入是规范的，要求一个节点找到的子节点的个数小于 k;
    int son_num;
    TreeNode *sons[27];
    TreeNode(int num):son_num(num){}
};
TreeNode* build_k_tree(string pre_str,string post_str){
    int len=pre_str.length();
    TreeNode * tree=new TreeNode(0);
    if(len>1){
        int right_pointer=len-2;//point to the post string
        int cnt_its_son=0;
        while(right_point>=0){
            cnt_its_sons++;
            string sub_pre;
            string sub_post;
            char r=post_str[len-2];
            for(int i=len-1;i>=;i--){
                if(pre_str[i]==r){
                    right_pointer=i-1;// the end of the next son
                    int dis=right_pointer-i+2;
                    sub_pre=pre_str.substr(i,dis);
                    sub_post=post_str.substr(i-1;dis)
                }
            }

            tree->sons[cnt_its_son-1]=build_k_tree(sub_pre,sub_post);
        }
        tree->son_num=cnt_its_sons;
    }
    return tree;
}
inline int C_m_k(int k){
    ret=1;
    for(int i=1;i<=k;i++){
        ret*=(m+1-i);
        ret/=i;
    }
    return ret;
}
int cnt_ans(TreeNode *root){
    int ret=1;
    ret*=C_m_k(root->son_num);
    for(int i=0;i<root->son_num;i++){
        ret*=cnt_ans(root->sons[i]);
    }
    return ret;
}
int main(){
    cin>>m;
    while(m){
        cin>>s1>>s2>>m;
        TreeNode *root=build_k_tree();
        int num=cnt_ans(root);
    }
    return 0;
}